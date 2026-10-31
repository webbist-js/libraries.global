FROM python:3.13-slim@sha256:2d44738ebf4ce5f63b9d9ea871e9c7cfdc0426f7b0c97cac915fd88ded1d86bb
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    ANALYSIS_HOST=0.0.0.0 ANALYSIS_PORT=3102 ANALYSIS_DATA_DIR=/data GDAL_CACHEMAX=64
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --require-hashes -r requirements.txt \
    && useradd --create-home --uid 10001 analysis \
    && mkdir /data && chown analysis:analysis /data
COPY *.py ./
COPY profiles ./profiles
COPY contracts ./contracts
RUN python -m unittest discover -p 'test_*.py'
USER analysis
EXPOSE 3102
CMD ["python", "server.py"]
