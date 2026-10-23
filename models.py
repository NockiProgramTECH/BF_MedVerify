"""Modeles SQLAlchemy ORM du projet BF-MedVerify."""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Produit(Base):
    __tablename__ = "produit"

    id_produit: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(Text, nullable=False)
    dci: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    laboratoire: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    titulaire_amm: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    code_amm: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dosage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    forme: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    lots: Mapped[list["Lot"]] = relationship(
        "Lot", back_populates="produit", cascade="all, delete-orphan"
    )


class Lot(Base):
    __tablename__ = "lot"
    __table_args__ = (
        UniqueConstraint("id_produit", "numero_lot", name="uq_lot_produit_numero"),
        CheckConstraint("statut IN ('ACTIF', 'RAPPELE')", name="ck_lot_statut"),
    )

    id_lot: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_produit: Mapped[int] = mapped_column(
        ForeignKey("produit.id_produit"), nullable=False
    )
    numero_lot: Mapped[str] = mapped_column(Text, nullable=False)
    date_fabrication: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    date_expiration: Mapped[date] = mapped_column(Date, nullable=False)
    statut: Mapped[str] = mapped_column(
        Text, nullable=False, default="ACTIF", server_default="ACTIF"
    )

    produit: Mapped["Produit"] = relationship("Produit", back_populates="lots")
    codes: Mapped[list["CodeSecurite"]] = relationship(
        "CodeSecurite", back_populates="lot", cascade="all, delete-orphan"
    )


class CodeSecurite(Base):
    __tablename__ = "code_securite"
    __table_args__ = (
        CheckConstraint(
            "statut IN ('NON_UTILISE', 'UTILISE', 'REVOQUE')",
            name="ck_code_securite_statut",
        ),
    )

    id_code: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_lot: Mapped[int] = mapped_column(ForeignKey("lot.id_lot"), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    statut: Mapped[str] = mapped_column(
        Text, nullable=False, default="NON_UTILISE", server_default="NON_UTILISE"
    )
    date_premiere_verification: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    premier_tel_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    lot: Mapped["Lot"] = relationship("Lot", back_populates="codes")
    verifications: Mapped[list["Verification"]] = relationship(
        "Verification", back_populates="code_securite"
    )
    alertes: Mapped[list["Alerte"]] = relationship(
        "Alerte", back_populates="code_securite"
    )


class Verification(Base):
    __tablename__ = "verification"
    __table_args__ = (
        Index("ix_verification_tel_date", "tel_hash", "date_heure"),
        Index("ix_verification_id_code", "id_code"),
        Index("ix_verification_resultat_date", "resultat", "date_heure"),
    )

    id_verification: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    id_code: Mapped[Optional[int]] = mapped_column(
        ForeignKey("code_securite.id_code"), nullable=True
    )
    code_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    date_heure: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    canal: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, default="SMS", server_default="SMS"
    )
    tel_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    resultat: Mapped[str] = mapped_column(Text, nullable=False)

    code_securite: Mapped[Optional["CodeSecurite"]] = relationship(
        "CodeSecurite", back_populates="verifications"
    )


class Alerte(Base):
    __tablename__ = "alerte"

    id_alerte: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    id_code: Mapped[Optional[int]] = mapped_column(
        ForeignKey("code_securite.id_code"), nullable=True
    )
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    date_heure: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    code_securite: Mapped[Optional["CodeSecurite"]] = relationship(
        "CodeSecurite", back_populates="alertes"
    )
