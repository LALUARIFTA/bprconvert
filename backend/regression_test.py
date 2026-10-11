"""End-to-end regression test exercising backend conversion endpoints with real fixtures."""
import io
import json
import fitz
from docx import Document
from openpyxl import Workbook
from PIL import Image
from app import app

client = app.test_client()

# 1. Health check
res = client.get('/api/health')
assert res.status_code == 200, res.data

# 2. Tools catalog check
tools_res = client.get('/api/tools')
assert tools_res.status_code == 200
catalog = tools_res.get_json()
assert len(catalog) == 40
ids = {item['id'] for item in catalog}
assert 'pdf-to-txt' in ids
assert 'pdf-tool-0' in ids

# Helper to create a single-page PDF with text
def create_pdf(text='BPRCONVERT Hello'):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text(fitz.Point(50, 100), text)
    buf = io.BytesIO(doc.tobytes())
    doc.close()
    return buf

# Helper to create a small image
def create_image():
    img = Image.new('RGB', (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

# 3. Test pdf-to-txt conversion
pdf_buf = create_pdf('Sample Document Test')
res = client.post('/api/convert/pdf-to-txt', data={'files': (pdf_buf, 'sample.pdf')}, content_type='multipart/form-data')
assert res.status_code == 200, res.data
assert b'Sample Document Test' in res.data

# 4. Test merge PDF (pdf-tool-0)
p1 = create_pdf('Page 1')
p2 = create_pdf('Page 2')
res = client.post('/api/convert/pdf-tool-0', data={'files': [(p1, 'p1.pdf'), (p2, 'p2.pdf')]}, content_type='multipart/form-data')
assert res.status_code == 200, res.data
with fitz.open(stream=res.data, filetype='pdf') as merged:
    assert merged.page_count == 2

# 5. Test rotate PDF (pdf-tool-14)
p = create_pdf('Rotate me')
res = client.post('/api/convert/pdf-tool-14', data={'files': (p, 'rotate.pdf'), 'angle': '90'}, content_type='multipart/form-data')
assert res.status_code == 200, res.data
with fitz.open(stream=res.data, filetype='pdf') as rotated:
    assert rotated[0].rotation == 90

# 6. Test CSV to JSON
csv_content = b"name,age\nAlice,30\nBob,25\n"
res = client.post('/api/convert/csv-to-json', data={'files': (io.BytesIO(csv_content), 'test.csv')}, content_type='multipart/form-data')
assert res.status_code == 200
parsed = json.loads(res.data.decode('utf-8'))
assert len(parsed) == 2
assert parsed[0]['name'] == 'Alice'

# 7. Test JSON to CSV
json_content = json.dumps([{"city": "Jakarta", "pop": 10000000}]).encode('utf-8')
res = client.post('/api/convert/json-to-csv', data={'files': (io.BytesIO(json_content), 'test.json')}, content_type='multipart/form-data')
assert res.status_code == 200
assert b'Jakarta' in res.data

# 8. Test Protect and Unlock PDF
p = create_pdf('Secret Content')
res = client.post('/api/convert/pdf-tool-17', data={'files': (p, 'doc.pdf'), 'password': 'mypassword'}, content_type='multipart/form-data')
assert res.status_code == 200
protected_bytes = res.data

res = client.post('/api/convert/pdf-tool-16', data={'files': (io.BytesIO(protected_bytes), 'doc.pdf'), 'password': 'mypassword'}, content_type='multipart/form-data')
assert res.status_code == 200
with fitz.open(stream=res.data, filetype='pdf') as unlocked:
    assert 'Secret Content' in unlocked[0].get_text()

res = client.post('/api/convert/pdf-tool-19', data={'files': (create_pdf(), 'doc.pdf')}, content_type='multipart/form-data')
assert res.status_code in (200, 503), res.data

print("All regression checks passed!")
