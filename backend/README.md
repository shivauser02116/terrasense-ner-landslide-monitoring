# NER Landslide Early Warning System — Backend API

This is the FastAPI backend for the NER Landslide Early Warning System.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
Copy `.env.example` to `.env` and fill in the values. You need a Firebase service account JSON file for Firestore/Storage access.

4. Run the server:
```bash
uvicorn main:app --reload
```

## Tests

Run tests using pytest:
```bash
pytest
```

## API Documentation

Once running, view the interactive API docs at `http://localhost:8000/docs`
