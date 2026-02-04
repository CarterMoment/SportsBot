from fastapi import FastAPI
from api.routes.health import router as health_router

app = FastAPI(title="Sports EV API")

app.include_router(health_router)

@app.get("/")
def root():
    return {"ok": True}
