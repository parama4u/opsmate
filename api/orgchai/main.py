"""OrgChai application entry point.

The legacy ``opsmate`` package remains importable so existing deployments can
roll back without losing access to their local data or environment settings.
"""

from opsmate.main import app

__all__ = ["app"]
