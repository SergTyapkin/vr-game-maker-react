# backend/api/materials.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

from database import get_db, MaterialModel
from schemas import MaterialData, MaterialCreate, MaterialUpdate, MaterialsListResponse, MaterialResponse

router = APIRouter()

@router.get("", response_model=MaterialsListResponse)
async def get_materials(db: Session = Depends(get_db)):
    materials = db.query(MaterialModel).all()

    return {
        "materials": [
            MaterialData(
                id=m.id,
                name=m.name,
                type=m.type,
                properties=m.properties or {},
                created_at=m.created_at,
                updated_at=m.updated_at
            )
            for m in materials
        ]
    }

@router.post("", response_model=MaterialResponse)
async def create_material(data: MaterialCreate, db: Session = Depends(get_db)):
    material_id = str(uuid.uuid4())

    material = MaterialModel(
        id=material_id,
        name=data.name,
        type=data.type,
        properties=data.properties or {}
    )

    db.add(material)
    db.commit()
    db.refresh(material)

    return {
        "material": MaterialData(
            id=material.id,
            name=material.name,
            type=material.type,
            properties=material.properties or {},
            created_at=material.created_at,
            updated_at=material.updated_at
        )
    }

@router.put("/{material_id}", response_model=MaterialResponse)
async def update_material(material_id: str, data: MaterialUpdate, db: Session = Depends(get_db)):
    material = db.query(MaterialModel).filter(MaterialModel.id == material_id).first()

    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if data.name is not None:
        material.name = data.name
    if data.properties is not None:
        material.properties = data.properties

    material.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(material)

    return {
        "material": MaterialData(
            id=material.id,
            name=material.name,
            type=material.type,
            properties=material.properties or {},
            created_at=material.created_at,
            updated_at=material.updated_at
        )
    }

@router.delete("/{material_id}")
async def delete_material(material_id: str, db: Session = Depends(get_db)):
    material = db.query(MaterialModel).filter(MaterialModel.id == material_id).first()

    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    db.delete(material)
    db.commit()

    return {"success": True}
