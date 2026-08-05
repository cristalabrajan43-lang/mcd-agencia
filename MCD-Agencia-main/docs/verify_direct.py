import requests
import base64
import json

URL = 'https://utacapulco-team-n54gkv7k.atlassian.net'
EMAIL = 'yamamotoherrera.cesaralejandro@utacapulco.edu.mx'
TOKEN = 'YOUR_JIRA_API_TOKEN'  # Replace with your actual token

H = {'Accept': 'application/json', 'Content-Type': 'application/json'}
auth_string = base64.b64encode(f'{EMAIL}:{TOKEN}'.encode()).decode()
H['Authorization'] = f'Basic {auth_string}'

# Get project details
print('Obteniendo detalles del proyecto...')
r = requests.get(f'{URL}/rest/api/2/project/MCD', headers=H)
project = r.json()
print(f'Proyecto: {project.get("name")}')
print(f'Clave: {project.get("key")}')
print()

# Get issues by key directly
print('Intentando obtener MCD-1 directamente...')
r = requests.get(f'{URL}/rest/api/2/issue/MCD-1', headers=H)
if r.status_code == 200:
    issue = r.json()
    print(f'✅ MCD-1 existe: {issue["fields"]["summary"]}')
else:
    print(f'❌ MCD-1 no encontrado')

print()
print('Intentando obtener MCD-12 (primera historia creada)...')
r = requests.get(f'{URL}/rest/api/2/issue/MCD-12', headers=H)
if r.status_code == 200:
    issue = r.json()
    print(f'✅ MCD-12 existe: {issue["fields"]["summary"]}')
    print(f'   Descripción: {len(issue["fields"].get("description", ""))} caracteres')
    print(f'   Story Points: {issue["fields"].get("customfield_10016")}')
else:
    print(f'❌ MCD-12 no encontrado ({r.status_code})')
