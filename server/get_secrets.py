import os
import base64

def get_secrets():
    print("\n" + "="*60)
    print("  RENDER ENVIRONMENT VARIABLES HELPER")
    print("="*60)
    print("Copy the values below and add them to your Render Web Service")
    print("under 'Environment' -> 'Add Environment Variable'.\n")

    # 1. CREDENTIALS_JSON
    if os.path.exists('credentials.json'):
        with open('credentials.json', 'r') as f:
            creds_content = f.read()
            print(f"Key:   CREDENTIALS_JSON")
            print(f"Value: {creds_content}")
            print("-" * 60)
    else:
        print("⚠ credentials.json not found!")

    # 2. TOKEN_PICKLE_B64
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as f:
            token_bytes = f.read()
            token_b64 = base64.b64encode(token_bytes).decode('utf-8')
            print(f"Key:   TOKEN_PICKLE_B64")
            print(f"Value: {token_b64}")
            print("-" * 60)
    else:
        print("⚠ token.pickle not found! (Run the app locally once to generate it)")

if __name__ == "__main__":
    get_secrets()
