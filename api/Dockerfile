FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      gcc libcups2-dev cups-client usbutils && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV CUPS_SERVER=/var/run/cups/cups.sock

EXPOSE 5100
CMD ["python", "app.py"]
