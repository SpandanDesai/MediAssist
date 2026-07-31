"""Domain / persistence-oriented model helpers.

Request and response contracts live in `app.schemas`. This package keeps a
stable import path for shared document shapes used across routes.
"""

from app.schemas.common import ConsultationResult, ConversationSummary, UserOut

__all__ = ["ConsultationResult", "ConversationSummary", "UserOut"]
