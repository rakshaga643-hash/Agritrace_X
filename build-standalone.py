import base64
import os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

with open('script.js', 'r', encoding='utf-8') as f:
    js = f.read()

def get_b64(path, mime):
    if not os.path.exists(path): return ''
    with open(path, 'rb') as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode('utf-8')

logo_png = get_b64('logo.png', 'image/png')
logo_jpg = get_b64('logo.jpg', 'image/jpeg')

# Embed CSS and JS
html = html.replace('<link rel="stylesheet" href="style.css">', f'<style>\n{css}\n</style>')
html = html.replace('<script src="script.js"></script>', f'<script>\n{js}\n</script>')

# Embed Images
html = html.replace('src="logo.png"', f'src="{logo_png}"')
html = html.replace("url('logo.jpg')", f"url('{logo_jpg}')")

# Create standalone package
with open('agritrace-standalone.html', 'w', encoding='utf-8') as f:
    f.write(html)
