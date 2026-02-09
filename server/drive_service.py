import os
import json
import pickle
import base64
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
import io

# Google Drive folder ID from the URL
DRIVE_FOLDER_ID = "1Q8_EETCD2ur9z9aCztv_Iy_5ZkrL3KO5"

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

class DriveService:
    def __init__(self, credentials_path="credentials.json"):
        """Initialize the Google Drive service with OAuth 2.0 credentials."""
        self.service = None
        self.credentials_path = credentials_path
        self._restore_credentials_from_env()
        self._initialize_service()
    
    def _restore_credentials_from_env(self):
        """Restore credentials.json and token.pickle from environment variables (for Render)."""
        # Restore credentials.json
        creds_json = os.environ.get('CREDENTIALS_JSON')
        if creds_json and not os.path.exists(self.credentials_path):
            try:
                with open(self.credentials_path, 'w') as f:
                    f.write(creds_json)
                print("✓ Restored credentials.json from environment variable")
            except Exception as e:
                print(f"✗ Failed to restore credentials.json from env: {e}")

        # Restore token.pickle (Base64 encoded)
        token_b64 = os.environ.get('TOKEN_PICKLE_B64')
        if token_b64 and not os.path.exists('token.pickle'):
            try:
                token_bytes = base64.b64decode(token_b64)
                with open('token.pickle', 'wb') as f:
                    f.write(token_bytes)
                print("✓ Restored token.pickle from environment variable")
            except Exception as e:
                print(f"✗ Failed to restore token.pickle from env: {e}")

    def _initialize_service(self):
        """Initialize the Google Drive API service using OAuth 2.0."""
        creds = None
        # The file token.pickle stores the user's access and refresh tokens
        if os.path.exists('token.pickle'):
            with open('token.pickle', 'rb') as token:
                creds = pickle.load(token)
        
        # If there are no (valid) credentials available, let the user log in.
        if not creds or not creds.valid:
            try:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    if os.path.exists(self.credentials_path):
                        flow = InstalledAppFlow.from_client_secrets_file(
                            self.credentials_path, SCOPES)
                        creds = flow.run_local_server(port=0)
                    else:
                        print(f"⚠ Credentials file not found: {self.credentials_path}")
                        print("  Please download OAuth 2.0 Client credentials and save as credentials.json")
                        return

                # Save the credentials for the next run
                with open('token.pickle', 'wb') as token:
                    pickle.dump(creds, token)
            except Exception as e:
                print(f"✗ Authentication failed: {e}")
                return

        try:
            self.service = build('drive', 'v3', credentials=creds)
            print("✓ Google Drive service initialized successfully")
        except Exception as e:
            print(f"✗ Failed to initialize Drive service: {e}")
    
    def save_whiteboard_state(self, state_data: dict) -> bool:
        """Save whiteboard state as JSON to Google Drive."""
        if not self.service:
            print("Drive service not available - saving locally")
            return self._save_locally(state_data)
        
        try:
            file_name = "whiteboard_state.json"
            json_content = json.dumps(state_data, indent=2)
            
            # Check if file already exists
            existing_file = self._find_file(file_name)
            
            media = MediaIoBaseUpload(
                io.BytesIO(json_content.encode('utf-8')),
                mimetype='application/json',
                resumable=True
            )
            
            if existing_file:
                # Update existing file
                self.service.files().update(
                    fileId=existing_file['id'],
                    media_body=media
                ).execute()
                print(f"✓ Updated {file_name} in Google Drive")
            else:
                # Create new file
                file_metadata = {
                    'name': file_name,
                    'parents': [DRIVE_FOLDER_ID],
                    'mimeType': 'application/json'
                }
                self.service.files().create(
                    body=file_metadata,
                    media_body=media,
                    fields='id'
                ).execute()
                print(f"✓ Created {file_name} in Google Drive")
            
            return True
        except Exception as e:
            print(f"✗ Error saving to Drive: {e}")
            return self._save_locally(state_data)
    
    def load_whiteboard_state(self) -> dict:
        """Load whiteboard state from Google Drive."""
        if not self.service:
            print("Drive service not available - loading locally")
            return self._load_locally()
        
        try:
            file_name = "whiteboard_state.json"
            existing_file = self._find_file(file_name)
            
            if not existing_file:
                print(f"No saved state found in Drive")
                return self._load_locally()
            
            # Download file content
            content = self.service.files().get_media(fileId=existing_file['id']).execute()
            state_data = json.loads(content.decode('utf-8'))
            print(f"✓ Loaded state from Google Drive ({len(state_data.get('nodes', []))} nodes)")
            return state_data
        except Exception as e:
            print(f"✗ Error loading from Drive: {e}")
            return self._load_locally()
    
    def upload_media(self, file_content: bytes, file_name: str, mime_type: str) -> str:
        """Upload a media file to Google Drive and return the file URL."""
        if not self.service:
            return None
        
        try:
            file_metadata = {
                'name': file_name,
                'parents': [DRIVE_FOLDER_ID]
            }
            
            media = MediaIoBaseUpload(
                io.BytesIO(file_content),
                mimetype=mime_type,
                resumable=True
            )
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webContentLink'
            ).execute()
            
            # Make file publicly accessible
            self.service.permissions().create(
                fileId=file['id'],
                body={'type': 'anyone', 'role': 'reader'}
            ).execute()
            
            # Get direct download link
            file = self.service.files().get(
                fileId=file['id'],
                fields='webContentLink'
            ).execute()
            
            print(f"✓ Uploaded {file_name} to Google Drive")
            return file.get('webContentLink', '')
        except Exception as e:
            print(f"✗ Error uploading media: {e}")
            return None
    
    def _find_file(self, file_name: str) -> dict:
        """Find a file by name in the specified folder."""
        try:
            query = f"name='{file_name}' and '{DRIVE_FOLDER_ID}' in parents and trashed=false"
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name)'
            ).execute()
            files = results.get('files', [])
            return files[0] if files else None
        except Exception as e:
            print(f"Error finding file: {e}")
            return None
    
    def _save_locally(self, state_data: dict) -> bool:
        """Fallback: save state locally."""
        try:
            with open('whiteboard_state.json', 'w') as f:
                json.dump(state_data, f, indent=2)
            print("✓ Saved state locally (whiteboard_state.json)")
            return True
        except Exception as e:
            print(f"✗ Error saving locally: {e}")
            return False
    
    def _load_locally(self) -> dict:
        """Fallback: load state from local file."""
        try:
            if os.path.exists('whiteboard_state.json'):
                with open('whiteboard_state.json', 'r') as f:
                    data = json.load(f)
                print(f"✓ Loaded state locally ({len(data.get('nodes', []))} nodes)")
                return data
        except Exception as e:
            print(f"✗ Error loading locally: {e}")
        return {'nodes': [], 'selectedNodeIds': []}
