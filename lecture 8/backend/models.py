"""Pydantic data objects shared by the agent and its tools.

Field names in yale_som_classes.json contain spaces, so each field
declares an alias matching the raw JSON key. Build a Course with
Course.model_validate(row) for raw rows, or by field name in code.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Course(BaseModel):
    """One row of data/yale_som_classes.json."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    course_id: str | None = Field(default=None, alias="Course ID")
    course_number: str | None = Field(default=None, alias="Course Number")
    course_title: str | None = Field(default=None, alias="Course Title")
    course_category: str | None = Field(default=None, alias="Course Category")
    course_type: str | None = Field(default=None, alias="Course Type")
    course_description: str | None = Field(default=None, alias="Course Description")
    course_session: str | None = Field(default=None, alias="Course Session")
    section: str | None = Field(default=None, alias="Section")
    units: str | None = Field(default=None, alias="Units")
    room: str | None = Field(default=None, alias="Room")
    daytimes: str | None = Field(default=None, alias="Daytimes")
    timings_day: str | None = Field(default=None, alias="Timings Day")
    timings_start_time: str | None = Field(default=None, alias="Timings StartTime")
    timings_end_time: str | None = Field(default=None, alias="Timings EndTime")
    faculty: str | None = Field(default=None, alias="Faculty 1")
    faculty_email: str | None = Field(default=None, alias="Faculty 1 Email")
    faculty_bio: str | None = Field(default=None, alias="faculty_bio")
    syllabus: str | None = Field(default=None, alias="Syllabus")
    old_syllabus: str | None = Field(default=None, alias="Old Syllabus")
    bid_or_permission: str | None = Field(default=None, alias="Bid Or Permission")
    term_code: str | None = Field(default=None, alias="TermCode")


class AgentResult(BaseModel):
    """What run_agent returns to main.py."""

    reply: str
    tools_used: list[str] = Field(default_factory=list)
