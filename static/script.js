// static/script.js

document.addEventListener('DOMContentLoaded', function () {
    const uploadForm = document.getElementById('upload-form');
    const imageInput = document.getElementById('image-input');
    const uploadStatus = document.getElementById('upload-status');
    const uploadDataForm = document.getElementById('upload-data-form');
    const dataInput = document.getElementById('data-input');
    const uploadDataStatus = document.getElementById('upload-data-status');
    const annotationSection = document.querySelector('.annotation-section');
    const imageContainer = document.getElementById('image-container');
    const image = document.getElementById('image');
    const canvas = document.getElementById('annotation-canvas');
    const saveButton = document.getElementById('save-annotations');
    const saveStatus = document.getElementById('save-status');
    const labelSelect = document.getElementById('label-select');

    let annotations = [];
    let currentBox = null;
    let isDrawing = false;

    // Handle image upload
    uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const file = imageInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        uploadStatus.textContent = 'Uploading...';

        fetch('/upload_image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                uploadStatus.textContent = 'Image uploaded successfully!';
                image.src = data.image_url;
                image.onload = function () {
                    // Adjust canvas size to image size
                    canvas.width = image.width;
                    canvas.height = image.height;
                    annotationSection.style.display = 'block';
                    clearCanvas();
                };
                imageContainer.style.display = 'block';
                annotations = [];  // Reset annotations
                saveButton.disabled = false;  // Enable save button
            } else {
                uploadStatus.textContent = `Image upload failed: ${data.message}`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            uploadStatus.textContent = 'An error occurred during image upload.';
        });
    });

    // Handle data file upload
    uploadDataForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const file = dataInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('data_file', file);

        uploadDataStatus.textContent = 'Uploading data file...';

        fetch('/upload_data', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                uploadDataStatus.textContent = 'Data file uploaded successfully!';
            } else {
                uploadDataStatus.textContent = `Data file upload failed: ${data.message}`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            uploadDataStatus.textContent = 'An error occurred during data file upload.';
        });
    });

    // Clear the canvas
    function clearCanvas() {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Start drawing bounding boxes
    imageContainer.addEventListener('mousedown', function (e) {
        const rect = canvas.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        isDrawing = true;
        currentBox = { startX, startY, endX: startX, endY: startY };
    });

    // Draw bounding boxes
    imageContainer.addEventListener('mousemove', function (e) {
        if (!isDrawing || !currentBox) return;
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        currentBox.endX = currentX;
        currentBox.endY = currentY;
        draw();
    });

    // Stop drawing and save the box
    imageContainer.addEventListener('mouseup', function (e) {
        if (!isDrawing || !currentBox) return;
        isDrawing = false;
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;
        currentBox.endX = endX;
        currentBox.endY = endY;

        const x = Math.min(currentBox.startX, currentBox.endX);
        const y = Math.min(currentBox.startY, currentBox.endY);
        const width = Math.abs(currentBox.endX - currentBox.startX);
        const height = Math.abs(currentBox.endY - currentBox.startY);

        if (width > 10 && height > 10) {  // Minimum size
            const label = labelSelect.value;
            const x_center = (x + width / 2) / image.width;
            const y_center = (y + height / 2) / image.height;
            const norm_width = width / image.width;
            const norm_height = height / image.height;

            annotations.push({
                label: label,
                x_center: x_center.toFixed(6),
                y_center: y_center.toFixed(6),
                width: norm_width.toFixed(6),
                height: norm_height.toFixed(6)
            });
        }

        currentBox = null;
        draw();
    });

    // Draw annotations on the canvas
    function draw() {
        clearCanvas();
        const ctx = canvas.getContext('2d');

        // Draw existing annotations
        annotations.forEach(box => {
            const x_center = parseFloat(box.x_center) * image.width;
            const y_center = parseFloat(box.y_center) * image.height;
            const width = parseFloat(box.width) * image.width;
            const height = parseFloat(box.height) * image.height;
            const x = x_center - width / 2;
            const y = y_center - height / 2;

            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            // Draw label
            ctx.fillStyle = 'blue';
            ctx.font = '16px Arial';
            ctx.fillText(box.label, x, y > 20 ? y - 5 : y + 15);
        });

        // Draw current box if drawing
        if (isDrawing && currentBox) {
            const x = Math.min(currentBox.startX, currentBox.endX);
            const y = Math.min(currentBox.startY, currentBox.endY);
            const width = Math.abs(currentBox.endX - currentBox.startX);
            const height = Math.abs(currentBox.endY - currentBox.startY);

            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
        }
    }

    // Save annotations in YOLO format
    saveButton.addEventListener('click', function () {
        if (annotations.length === 0) {
            alert('No annotations to save!');
            return;
        }

        const imageFilename = image.src.split('/').pop();
        fetch('/save_annotations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_filename: imageFilename,
                annotations: annotations
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                saveStatus.textContent = data.message;
                alert('Annotations saved successfully!');
                // Redirect to view annotations
                window.location.href = `/view_annotations/${imageFilename}`;
            } else {
                saveStatus.textContent = `Error: ${data.message}`;
                alert(`Error: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            saveStatus.textContent = 'An error occurred while saving annotations.';
            alert('An error occurred while saving annotations.');
        });
    });
});
