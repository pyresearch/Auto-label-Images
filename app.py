from flask import Flask, request, render_template, redirect, url_for, send_file, session, flash
import os
import cv2
import shutil
import json
import zipfile
from werkzeug.utils import secure_filename
from autodistill.detection import CaptionOntology
from autodistill_grounded_sam import GroundedSAM

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Set a secret key for session management

# Define folder paths
IMAGES = "uploads"  # Folder where all unzipped images will be stored (flattened, no subfolders)
OUTPUT_DIR = "Labeled_Images"  # Output folder for the labeled dataset
ANNOTATIONS_DIR = os.path.join(OUTPUT_DIR, "annotations")
TRAIN_DIR = os.path.join(OUTPUT_DIR, "train")
VALID_DIR = os.path.join(OUTPUT_DIR, "valid")
DATA_YAML_PATH = os.path.join(OUTPUT_DIR, "data.yaml")

# Ensure directories exist
def ensure_directories():
    os.makedirs(IMAGES, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(ANNOTATIONS_DIR, exist_ok=True)
    os.makedirs(TRAIN_DIR, exist_ok=True)
    os.makedirs(VALID_DIR, exist_ok=True)

# Function to delete and recreate dataset folder structure
def clear_output_folders():
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    if os.path.exists(IMAGES):
        shutil.rmtree(IMAGES)
    ensure_directories()

# Function to extract only images from a ZIP file to the IMAGES folder (no subfolders)
def extract_images_from_zip(zip_file):
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        for file_info in zip_ref.infolist():
            # Extract only files with supported image extensions and flatten folder structure
            if file_info.filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                file_info.filename = os.path.basename(file_info.filename)  # Flatten the structure
                zip_ref.extract(file_info, IMAGES)

# Home route to render the HTML form
@app.route('/')
def index():
    return render_template('index.html')

# Route to handle the form submission and image processing
@app.route('/label_images', methods=['POST'])
def label_images():
    try:
        object_names = request.form.get('object_names')  # Get object names from form input
        zip_file = request.files['zip_file']  # Get the uploaded ZIP file
        
        if not object_names or not zip_file:
            session['error'] = "Please provide object names and a ZIP file."
            return redirect(url_for('index'))
        
        # Split object names into a list
        object_name_list = [name.strip() for name in object_names.split(",")]

        # Clear the output folders and ensure new ones are created
        clear_output_folders()

        # Save the ZIP file securely
        zip_filename = secure_filename(zip_file.filename)
        zip_filepath = os.path.join(IMAGES, zip_filename)
        zip_file.save(zip_filepath)

        # Extract only images from the ZIP file into the IMAGES folder
        extract_images_from_zip(zip_filepath)

        # Check if any valid images were extracted
        image_files = [f for f in os.listdir(IMAGES) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        if not image_files:
            session['error'] = "No valid images found in the ZIP file."
            return redirect(url_for('index'))

        # Step 1: Define the Ontology for the objects
        ontology_dict = {name: name for name in object_name_list}
        ontology = CaptionOntology(ontology_dict)

        # Step 2: Initialize GroundedSAM with the specified object ontology
        base_model = GroundedSAM(ontology=ontology)

        # Step 3: Label the images and output to the annotations folder
        base_model.label(
            input_folder=IMAGES,  # Use the extracted IMAGES folder directly
            extension=".jpg",  # Set this to match your images' extensions
            output_folder=ANNOTATIONS_DIR  # Save annotations to the annotations folder
        )

        # Success feedback
        session['success'] = f"Labeled {len(image_files)} images successfully!"
        return redirect(url_for('index'))
    except Exception as e:
        session['error'] = f"An error occurred: {str(e)}"
        return redirect(url_for('index'))

# Route to provide the ZIP file for download
@app.route('/download/<filename>')
def download_zip(filename):
    zip_filepath = os.path.join(OUTPUT_DIR, filename)
    return send_file(zip_filepath, as_attachment=True)

# Run the Flask app
if __name__ == '__main__':
    ensure_directories()  # Ensure the directories are ready before starting the server
    app.run(host='0.0.0.0', port=5000, debug=True)
