FROM python:3.12-slim
WORKDIR /app
COPY quc_v29_server.py /app/quc_v29_server.py
ENV PYTHONUNBUFFERED=1
CMD ["python3","/app/quc_v29_server.py"]
