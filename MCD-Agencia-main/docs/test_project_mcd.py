import requests
import base64
import json

JIRA_URL = 'https://utacapulco-team-n54gkv7k.atlassian.net'
JIRA_EMAIL = 'yamamotoherrera.cesaralejandro@utacapulco.edu.mx'
JIRA_API_TOKEN = 'YOUR_JIRA_API_TOKEN'  # Replace with your actual token

HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
}

auth_string = base64.b64encode(f'{JIRA_EMAIL}:{JIRA_API_TOKEN}'.encode()).decode()
HEADERS['Authorization'] = f'Basic {auth_string}'

print('=' * 80)
print('DIAGNÓSTICO DE PROYECTO MCD')
print('=' * 80)

# Get project info
print('\n1️⃣  Obteniendo info del proyecto MCD...')
response = requests.get(f'{JIRA_URL}/rest/api/3/project/MCD', headers=HEADERS)
print(f'   Status: {response.status_code}')

if response.status_code == 200:
    project = response.json()
    print(f'   ✅ Proyecto encontrado: {project.get("name")}')
    print(f'   Tipo: {project.get("projectTypeKey")}')
    
    # Get issue types
    print('\n2️⃣  Tipos de Issues disponibles:')
    for issue_type in project.get('issueTypes', []):
        print(f'   - {issue_type.get("name")} (ID: {issue_type.get("id")})')
    
    # Check if Epic is available
    has_epic = any(it.get("name") == "Epic" for it in project.get('issueTypes', []))
    if has_epic:
        print('   ✅ Epic type está disponible')
    else:
        print('   ❌ Epic type NO está disponible')
        print('   Esto es el problema! El proyecto no es Scrum o no permite Epics')
else:
    print(f'   ❌ Error: {response.status_code}')
    print(f'   {response.text}')

print('\n' + '=' * 80)
