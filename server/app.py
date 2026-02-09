"""
Flask Backend Server for Miro Clone
Handles saving/loading whiteboard state to/from Google Drive
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from drive_service import DriveService
import os

app = Flask(__name__)
# Allow all origins for simplicity in deployment. For production, you might want to restrict this.
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize Google Drive service
drive_service = DriveService()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'drive_connected': drive_service.service is not None
    })

@app.route('/api/save', methods=['POST'])
def save_state():
    """Save whiteboard state to Google Drive."""
    try:
        state = request.json
        if not state:
            return jsonify({'error': 'No data provided'}), 400
        
        success = drive_service.save_whiteboard_state(state)
        return jsonify({
            'success': success,
            'message': 'State saved successfully' if success else 'Failed to save state'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/load', methods=['GET'])
def load_state():
    """Load whiteboard state from Google Drive."""
    try:
        state = drive_service.load_whiteboard_state()
        return jsonify(state)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload-media', methods=['POST'])
def upload_media():
    """Upload media file to Google Drive."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        file_content = file.read()
        file_url = drive_service.upload_media(
            file_content,
            file.filename,
            file.content_type or 'application/octet-stream'
        )
        
        if file_url:
            return jsonify({'url': file_url, 'success': True})
        else:
            return jsonify({'error': 'Failed to upload file'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("\n" + "="*50)
    print("  Miro Clone Backend Server")
    print("="*50)
    # Check drive service status safely
    is_connected = False
    try:
        if hasattr(drive_service, 'service') and drive_service.service:
            is_connected = True
    except:
        pass
        
    print(f"  Google Drive: {'Connected ✓' if is_connected else 'Not connected (add credentials.json)'}")
    print(f"  Server running on port {port}")
    print("="*50 + "\n")
    
    # In production (Render), execute with gunicorn, but this entry point is for local dev
    app.run(host='0.0.0.0', port=port, debug=True)
