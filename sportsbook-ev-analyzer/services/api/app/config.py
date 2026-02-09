import os
from pathlib import Path

class Settings:
    # Firebase configuration
    firebase_project_id: str = os.getenv('FIREBASE_PROJECT_ID', '')
    firebase_service_account_path: str = os.getenv(
        'FIREBASE_SERVICE_ACCOUNT_PATH', 
        '../../config/firebase-service-account.json'
    )
    
    # API configuration
    api_port: int = int(os.getenv('API_PORT', '8000'))
    
    # Environment
    environment: str = os.getenv('NODE_ENV', 'development')
    
    def __init__(self):
        # Load from .env file if it exists
        from dotenv import load_dotenv
        
        # Look for .env in the api service directory
        env_path = Path(__file__).parent.parent / '.env'
        if env_path.exists():
            load_dotenv(env_path)
            # Reload values after loading .env
            self.firebase_project_id = os.getenv('FIREBASE_PROJECT_ID', '')
            self.firebase_service_account_path = os.getenv(
                'FIREBASE_SERVICE_ACCOUNT_PATH',
                '../../config/firebase-service-account.json'
            )
            self.api_port = int(os.getenv('API_PORT', '8000'))
            self.environment = os.getenv('NODE_ENV', 'development')

settings = Settings()