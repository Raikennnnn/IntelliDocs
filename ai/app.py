from flask import Flask, request, jsonify
import easyocr
import cv2
import os
from werkzeug.utils import secure_filename
import numpy as np

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'ai/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

reader = easyocr.Reader(['en'])

@app.route('/verify', methods=['POST'])
def verify_doc():
    if 'image' not in request.files:
        return jsonify({'error': 'No image'}), 400
    
    file = request.files['image']
    doc_type = request.form['doc_type']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # OCR Processing
    result = reader.readtext(filepath)
    text = ' '.join([detection[1] for detection in result])
    
    # Simple verification logic (expand per doc_type)
    confidence = 0.8  # Mock - implement real logic
    
    if doc_type == 'form157':
        verified = 'LRN' in text and len(text.split()) > 50
    else:
        verified = confidence > 0.7
    
    os.remove(filepath)  # Cleanup
    
    return jsonify({
        'status': 'verified' if verified else 'failed',
        'confidence': confidence,
        'extracted_text': text[:500]
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)

