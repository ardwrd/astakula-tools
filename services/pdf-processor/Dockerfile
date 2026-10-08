FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home --shell /usr/sbin/nologin astakula
COPY app.py ./
USER astakula
EXPOSE 8080
CMD ["python", "/app/app.py"]
