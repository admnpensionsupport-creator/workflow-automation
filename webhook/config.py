"""
Configuration for the webhook receiver.
Values are loaded from environment variables with fallback defaults.
To update credentials, set the corresponding environment variables
or update the defaults here.
"""

import os

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL",
    "https://uvoahchfsjzthvsszloh.supabase.co"
)

SUPABASE_SERVICE_KEY = os.environ.get(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2b2FoY2hmc2p6dGh2c3N6bG9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ1MjYwNCwiZXhwIjoyMDkyMDI4NjA0fQ.smOB20C1iZ8t6JbFhH-sFFH1iWSD4dnKYsHL5Agx8Z8"
)

SUPABASE_TABLE = os.environ.get("SUPABASE_TABLE", "Cold Email")
