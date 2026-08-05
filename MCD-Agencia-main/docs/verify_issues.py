import requests
import base64

URL = 'https://utacapulco-team-n54gkv7k.atlassian.net'
EMAIL = 'yamamotoherrera.cesaralejandro@utacapulco.edu.mx'
TOKEN = 'YOUR_JIRA_API_TOKEN'  # Replace with your actual token

H = {'Accept': 'application/json', 'Content-Type': 'application/json'}
auth_string = base64.b64encode(f'{EMAIL}:{TOKEN}'.encode()).decode()
H['Authorization'] = f'Basic {auth_string}'

# Test simple search
r = requests.get(f'{URL}/rest/api/2/search?jql=project=MCD&maxResults=50', headers=H)
data = r.json()

print('=' * 80)
print('VERIFICACIÓN DE ISSUES EN MCD')
print('=' * 80)
print(f'\nTotal issues en proyecto: {data.get("total")}')
print(f'Issues devueltos: {len(data.get("issues", []))}')
print()

for issue in data.get('issues', []):
    key = issue['key']
    itype = issue['fields']['issuetype']['name']
    summary = issue['fields'].get('summary', 'N/A')[:45]
    pts = issue['fields'].get('customfield_10016')
    print(f'{key}: [{itype}] {summary} ({pts} pts)')

print()
print('=' * 80)
