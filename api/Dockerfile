FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      cups-client usbutils && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./

ENV CUPS_SERVER=/var/run/cups/cups.sock

EXPOSE 5100
# Threads: a slow outside call (Google, Gemini, the Recalbox...) no longer blocks the other requests
CMD ["gunicorn", "--workers", "2", "--threads", "4", "--bind", "0.0.0.0:5100", "--timeout", "30", "app:app"]
