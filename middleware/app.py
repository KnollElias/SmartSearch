from flask import Flask, request, jsonify
import requests
import os
import json

app = Flask(__name__)

api_url = "http://127.0.0.1:11434/api/generate"
history = []
context_dir = "../dataset"

def load_context(extra_context=""):
    """Loads all text files in 'dataset' folder and merges them with user-provided context."""
    context_texts = [extra_context]  # Start with user-provided context

    if not os.path.exists(context_dir):
        os.makedirs(context_dir)

    # Load text files from dataset
    for filename in os.listdir(context_dir):
        if filename.endswith(".txt") or filename.endswith(".json"):
            with open(os.path.join(context_dir, filename), "r", encoding="utf-8") as file:
                context_texts.append(file.read())

    return "\n".join(context_texts)  # Merge all files into one context string

@app.route('/ask', methods=['POST'])
def ask_model():
    """API endpoint to query the model with optional extra context."""
    global history
    data = request.json
    question = data.get("question", "")
    extra_context = data.get("extra_context", "")  # Optional user-added context

    context = load_context(extra_context)  # Load dataset + user-provided context
    system_prompt = f"Use the following context for better accuracy:\n{context}\n"

    history.append({"role": "system", "content": system_prompt})
    history.append({"role": "user", "content": question})

    try:
        response = requests.post(api_url, json={
            "model": "mistral",
            "prompt": "\n".join([msg["content"] for msg in history]),
            "stream": False
        }).json()

        if "response" not in response:
            return jsonify({"error": "Model did not generate a response.", "raw_response": response}), 500

        reply = response["response"]
        history.append({"role": "assistant", "content": reply})
        return jsonify({"reply": reply})

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to connect to the model: {str(e)}"}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """Allows users to upload text files to use as context."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    file_path = os.path.join(context_dir, file.filename)

    file.save(file_path)  # Save file in dataset folder
    return jsonify({"message": f"File {file.filename} uploaded successfully!"})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
