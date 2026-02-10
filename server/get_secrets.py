import os
import base64

def get_secrets():
    # Get the directory where this script is located (server/)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("\n" + "="*60)
    print("  RENDER ENVIRONMENT VARIABLES HELPER")
    print("="*60)
    print("Copy the values below and add them to your Render Web Service")
    print("under 'Environment' -> 'Add Environment Variable'.\n")

    # 1. CREDENTIALS_JSON
    creds_path = os.path.join(base_dir, 'credentials.json')
    if os.path.exists(creds_path):
        with open(creds_path, 'r') as f:
            creds_content = f.read()
            print(f"Key:   CREDENTIALS_JSON")
            print(f"Value: {creds_content}")
            print("-" * 60)
    else:
        print(f"⚠ credentials.json not found at {creds_path}!")

    # 2. TOKEN_PICKLE_B64
    token_path = os.path.join(base_dir, 'token.pickle')
    if os.path.exists(token_path):
        with open(token_path, 'rb') as f:
            token_bytes = f.read()
            token_b64 = base64.b64encode(token_bytes).decode('utf-8')
            print(f"Key:   TOKEN_PICKLE_B64")
            print(f"Value: {token_b64}")
            print("-" * 60)
    else:
        print(f"⚠ token.pickle not found at {token_path}! (Run the app locally once to generate it)")

if __name__ == "__main__":
    get_secrets()
