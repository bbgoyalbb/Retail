"""Router package for the Retail API."""
from .bills import router as bills_router
from .tailoring import router as tailoring_router
from .jobwork import router as jobwork_router
from .settlements import router as settlements_router
from .daybook import router as daybook_router
from .labour import router as labour_router
from .advances import router as advances_router
from .orders import router as orders_router
from .items import router as items_router
from .reports import router as reports_router
from .data import router as data_router
from .auth_routes import router as auth_router

__all__ = [
    "bills_router", "tailoring_router", "jobwork_router",
    "settlements_router", "daybook_router", "labour_router",
    "advances_router", "orders_router", "items_router",
    "reports_router", "data_router", "auth_router",
]
