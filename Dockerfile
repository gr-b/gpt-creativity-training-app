# Switch to a new stage for the backend setup
FROM python:3.9-slim-buster

# Set the working directory to /app
WORKDIR /app

# Copy the requirements.txt file to the container
COPY backend/requirements.txt ./

# Install the Python dependencies from requirements.txt
RUN pip3 install -r requirements.txt

# Copy the rest of the application files to the container
COPY backend/ ./

COPY frontend/build ./build

# Expose port 5000 for the Flask server
EXPOSE 5000

# Set the OpenAI API key environment variable
#ENV OPENAI_API_KEY=your_api_key_here

## Start the Flask server
#CMD [ "python3", "server.py" ]

# Start gunicorn server
CMD [ "gunicorn", "--bind", "0.0.0.0:5000", "server:app", "--workers", "6", "--threads", "4" ]