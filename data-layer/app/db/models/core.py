from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON, ForeignKey, UniqueConstraint, Index
from sqlalchemy.sql import func
from app.db.base import Base

class Meeting(Base):
    __tablename__ = "meetings"
    meeting_key = Column(Integer, primary_key=True, index=True)
    meeting_name = Column(String)
    meeting_official_name = Column(String)
    country_name = Column(String)
    country_code = Column(String)
    location = Column(String)
    circuit_short_name = Column(String)
    date_start = Column(DateTime)
    date_end = Column(DateTime)
    year = Column(Integer, index=True)
    source = Column(String, default="openf1")
    ingested_at = Column(DateTime, default=func.now())

class Session(Base):
    __tablename__ = "sessions"
    session_key = Column(Integer, primary_key=True, index=True)
    meeting_key = Column(Integer, index=True)
    session_name = Column(String)
    session_type = Column(String)
    date_start = Column(DateTime)
    date_end = Column(DateTime)
    gmt_offset = Column(String)
    year = Column(Integer)
    country_name = Column(String)
    location = Column(String)
    is_race_session = Column(Boolean, default=False)
    source = Column(String, default="openf1")
    ingested_at = Column(DateTime, default=func.now())

class Driver(Base):
    __tablename__ = "drivers"
    session_key = Column(Integer, primary_key=True)
    driver_number = Column(Integer, primary_key=True)
    broadcast_name = Column(String)
    full_name = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    name_acronym = Column(String)
    team_name = Column(String)
    team_colour = Column(String)
    headshot_url = Column(String)
    country_code = Column(String)
    source = Column(String, default="openf1")
    ingested_at = Column(DateTime, default=func.now())
    
class RaceControlMessage(Base):
    __tablename__ = "race_control_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_key = Column(Integer, index=True)
    meeting_key = Column(Integer)
    date = Column(DateTime)
    lap_number = Column(Integer, nullable=True)
    category = Column(String)
    flag = Column(String, nullable=True)
    scope = Column(String, nullable=True)
    sector = Column(Integer, nullable=True)
    driver_number = Column(Integer, nullable=True)
    message = Column(String)
    raw_payload = Column(JSON)
    source = Column(String, default="openf1")
    ingested_at = Column(DateTime, default=func.now())

class Lap(Base):
    __tablename__ = "laps"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_key = Column(Integer, index=True)
    meeting_key = Column(Integer)
    driver_number = Column(Integer, index=True)
    lap_number = Column(Integer, index=True)
    date_start = Column(DateTime)
    lap_duration = Column(Float, nullable=True)
    is_pit_out_lap = Column(Boolean, default=False)
    duration_sector_1 = Column(Float, nullable=True)
    duration_sector_2 = Column(Float, nullable=True)
    duration_sector_3 = Column(Float, nullable=True)
    source = Column(String, default="openf1")
    ingested_at = Column(DateTime, default=func.now())
    __table_args__ = (UniqueConstraint('session_key', 'driver_number', 'lap_number'),)

class PitStop(Base):
    __tablename__ = "pit_stops"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_key = Column(Integer, index=True)
    meeting_key = Column(Integer)
    driver_number = Column(Integer, index=True)
    date = Column(DateTime)
    lap_number = Column(Integer)
    pit_duration = Column(Float, nullable=True)
    source = Column(String, default="openf1")
    ingested_at = Column(DateTime, default=func.now())

class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_key = Column(Integer, index=True)
    meeting_key = Column(Integer)
    driver_number = Column(Integer, index=True)
    date = Column(DateTime)
    position = Column(Integer)
    source = Column(String, default="openf1")
    ingested_at = Column(DateTime, default=func.now())
    __table_args__ = (Index('ix_positions_session_driver_date', 'session_key', 'driver_number', 'date'),)

class Interval(Base):
    __tablename__ = "intervals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_key = Column(Integer, index=True)
    meeting_key = Column(Integer)
    driver_number = Column(Integer, index=True)
    date = Column(DateTime)
    gap_to_leader = Column(Float, nullable=True)
    interval = Column(Float, nullable=True)
    source = Column(String, default="openf1")
    ingested_at = Column(DateTime, default=func.now())
    __table_args__ = (Index('ix_intervals_session_driver_date', 'session_key', 'driver_number', 'date'),)
