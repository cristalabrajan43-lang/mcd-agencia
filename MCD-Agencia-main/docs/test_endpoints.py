import requests
import base64

JIRA_URL = 'https://utacapulco-team-n54gkv7k.atlassian.net'
JIRA_EMAIL = 'yamamotoherrera.cesaralejandro@utacapulco.edu.mx'
JIRA_API_TOKEN = 'YOUR_JIRA_API_TOKEN'  # Replace with your actual token

HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
}

auth_string = base64.b64encode(f'{JIRA_EMAIL}:{JIRA_API_TOKEN}'.encode()).decode()
HEADERS['Authorization'] = f'Basic {auth_string}'

print('Testing Different API Endpoints...\n')

# Test v2
payload_v2 = {
    "fields": {
        "project": {"key": "MCD"},
        "summary": "Test Issue",
        "issuetype": {"name": "Historia"},
    }
}

print('1. Testing /rest/api/2/issue')
response = requests.post(f'{JIRA_URL}/rest/api/2/issue', json=payload_v2, headers=HEADERS)
print(f'   Status: {response.status_code}')
if response.status_code != 404:
    print(f'   ✅ This endpoint works!')
    print(f'   Response: {response.json()}')
else:
    print(f'   ❌ Also 404')

print()

# Test cloud API
payload_cloud = {
    "fields": {
        "project": {"key": "MCD"},
        "summary": "Test Issue",
        "issuetype": {"name": "Historia"},
    }
}

print('2. Testing /rest/cloud/1.0/issues')
response = requests.post(f'{JIRA_URL}/rest/cloud/1.0/issues', json=payload_cloud, headers=HEADERS)
print(f'   Status: {response.status_code}')
if response.status_code != 404:
    print(f'   ✅ This endpoint works!')
else:
    print(f'   ❌ 404')

print('\n' + '=' * 80)
