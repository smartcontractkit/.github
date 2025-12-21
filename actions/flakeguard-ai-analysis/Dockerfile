FROM python:3.14-slim

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

COPY context/ context/
COPY src/ src/
COPY main.py main.py

ENTRYPOINT ["python3.11", "/main.py"]
