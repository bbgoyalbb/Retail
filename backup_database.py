"""
MongoDB Backup Script for Retail Management System

Usage:
    python backup_database.py           # Interactive mode
    python backup_database.py --auto    # Auto mode (no prompts, uses .env)
    python backup_database.py --restore <backup_file>  # Restore from backup

Features:
    - Creates timestamped backups
    - Compresses backups to save space
    - Keeps last 30 backups by default
    - Can restore from backup
    - Logs all operations
"""
import os
import sys
import json
import gzip
import shutil
import logging
import argparse
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("backup.log", encoding="utf-8"),
    ]
)
logger = logging.getLogger(__name__)

# Configuration
ROOT_DIR = Path(__file__).parent
BACKUP_DIR = ROOT_DIR / "backups"
MAX_BACKUPS = 30  # Keep last 30 backups


def load_config():
    """Load MongoDB configuration from .env file."""
    env_file = ROOT_DIR / "backend" / ".env"
    if env_file.exists():
        load_dotenv(env_file)

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")

    if not mongo_url:
        mongo_url = input("Enter MongoDB URL (default: mongodb://localhost:27017): ").strip()
        if not mongo_url:
            mongo_url = "mongodb://localhost:27017"

    if not db_name:
        db_name = input("Enter database name (default: retail_book): ").strip()
        if not db_name:
            db_name = "retail_book"

    return mongo_url, db_name


def create_backup(mongo_url: str, db_name: str) -> Path:
    """Create a compressed backup of the database."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_name = f"{db_name}_{timestamp}"
    backup_path = BACKUP_DIR / backup_name
    compressed_path = Path(f"{backup_path}.json.gz")

    logger.info(f"Starting backup of database '{db_name}'...")
    logger.info(f"Backup file: {compressed_path}")

    try:
        # Connect to MongoDB
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        db = client[db_name]

        # Verify connection
        client.admin.command('ping')
        logger.info("Connected to MongoDB")

        # Get all collections
        collections = db.list_collection_names()
        logger.info(f"Found {len(collections)} collections: {', '.join(collections)}")

        # Export all data
        backup_data = {
            "metadata": {
                "database": db_name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "version": "1.0",
                "collections_count": len(collections),
            },
            "collections": {}
        }

        total_docs = 0
        for collection_name in collections:
            collection = db[collection_name]
            documents = list(collection.find())

            # Convert ObjectId to string for JSON serialization
            for doc in documents:
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
                # Convert datetime objects to ISO format strings
                for key, value in doc.items():
                    if hasattr(value, 'isoformat'):
                        doc[key] = value.isoformat()

            backup_data["collections"][collection_name] = documents
            total_docs += len(documents)
            logger.info(f"  - {collection_name}: {len(documents)} documents")

        backup_data["metadata"]["total_documents"] = total_docs

        # Ensure backup directory exists
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        # Write compressed backup
        json_data = json.dumps(backup_data, indent=2, default=str)
        with gzip.open(compressed_path, 'wt', encoding='utf-8') as f:
            f.write(json_data)

        # Get file size
        file_size = compressed_path.stat().st_size
        file_size_mb = file_size / (1024 * 1024)

        logger.info(f"Backup completed successfully!")
        logger.info(f"  File: {compressed_path}")
        logger.info(f"  Size: {file_size_mb:.2f} MB")
        logger.info(f"  Documents: {total_docs}")

        client.close()
        return compressed_path

    except Exception as e:
        logger.error(f"Backup failed: {e}")
        raise


def restore_backup(backup_file: Path, mongo_url: str, db_name: str, drop_existing: bool = False):
    """Restore database from a backup file."""
    logger.info(f"Starting restore from {backup_file}...")

    try:
        # Read backup file
        if backup_file.suffix == '.gz':
            with gzip.open(backup_file, 'rt', encoding='utf-8') as f:
                backup_data = json.load(f)
        else:
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)

        metadata = backup_data.get("metadata", {})
        collections_data = backup_data.get("collections", {})

        logger.info(f"Backup created: {metadata.get('timestamp', 'unknown')}")
        logger.info(f"Collections: {len(collections_data)}")

        # Connect to MongoDB
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        db = client[db_name]

        # Verify connection
        client.admin.command('ping')
        logger.info("Connected to MongoDB")

        if drop_existing:
            confirm = input(f"WARNING: This will DROP all existing data in '{db_name}'. Type 'yes' to confirm: ")
            if confirm.lower() != 'yes':
                logger.info("Restore cancelled by user")
                return

            # Drop all collections
            for collection_name in db.list_collection_names():
                db.drop_collection(collection_name)
                logger.info(f"Dropped collection: {collection_name}")

        # Restore collections
        total_docs = 0
        for collection_name, documents in collections_data.items():
            collection = db[collection_name]

            # Convert string _id back to ObjectId where possible
            for doc in documents:
                if "_id" in doc:
                    from bson.objectid import ObjectId
                    try:
                        doc["_id"] = ObjectId(doc["_id"])
                    except:
                        pass  # Keep as string if not valid ObjectId

            if documents:
                collection.insert_many(documents)
                total_docs += len(documents)

            logger.info(f"  - {collection_name}: {len(documents)} documents restored")

        logger.info(f"Restore completed! Total documents: {total_docs}")
        client.close()

    except Exception as e:
        logger.error(f"Restore failed: {e}")
        raise


def cleanup_old_backups():
    """Remove old backups, keeping only the most recent MAX_BACKUPS."""
    if not BACKUP_DIR.exists():
        return

    backup_files = sorted(
        BACKUP_DIR.glob("*.json.gz"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )

    if len(backup_files) > MAX_BACKUPS:
        to_delete = backup_files[MAX_BACKUPS:]
        for backup_file in to_delete:
            backup_file.unlink()
            logger.info(f"Cleaned up old backup: {backup_file.name}")


def list_backups():
    """List all available backups."""
    if not BACKUP_DIR.exists():
        logger.info("No backups directory found")
        return

    backup_files = sorted(
        BACKUP_DIR.glob("*.json.gz"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )

    if not backup_files:
        logger.info("No backups found")
        return

    print("\nAvailable Backups:")
    print("-" * 80)
    print(f"{'#':<4} {'Date':<20} {'Database':<20} {'Size':<12} {'File'}")
    print("-" * 80)

    for i, backup_file in enumerate(backup_files, 1):
        stat = backup_file.stat()
        size_mb = stat.st_size / (1024 * 1024)
        mtime = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")

        # Try to extract db name from filename
        db_name = backup_file.stem.replace('.json', '').rsplit('_', 1)[0]

        print(f"{i:<4} {mtime:<20} {db_name:<20} {size_mb:>6.2f} MB   {backup_file.name}")

    print("-" * 80)
    print(f"Total: {len(backup_files)} backups (keeping last {MAX_BACKUPS})\n")


def main():
    parser = argparse.ArgumentParser(description="MongoDB Backup Tool")
    parser.add_argument("--auto", action="store_true", help="Auto mode (no prompts)")
    parser.add_argument("--restore", type=str, metavar="FILE", help="Restore from backup file")
    parser.add_argument("--list", action="store_true", help="List all backups")
    parser.add_argument("--drop", action="store_true", help="Drop existing data before restore")
    parser.add_argument("--mongo-url", type=str, help="MongoDB URL")
    parser.add_argument("--db-name", type=str, help="Database name")

    args = parser.parse_args()

    # Load config from .env if not provided via args
    if not args.mongo_url or not args.db_name:
        load_config()

    mongo_url = args.mongo_url or os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = args.db_name or os.environ.get("DB_NAME", "retail_book")

    if args.list:
        list_backups()
        return

    if args.restore:
        backup_file = Path(args.restore)
        if not backup_file.exists():
            # Try looking in backups directory
            backup_file = BACKUP_DIR / args.restore
            if not backup_file.exists():
                logger.error(f"Backup file not found: {args.restore}")
                sys.exit(1)

        restore_backup(backup_file, mongo_url, db_name, drop_existing=args.drop)
        return

    # Create backup
    try:
        backup_path = create_backup(mongo_url, db_name)
        cleanup_old_backups()

        if not args.auto:
            print(f"\nBackup created: {backup_path}")
            print(f"Backup directory: {BACKUP_DIR.absolute()}")

    except Exception as e:
        logger.error(f"Backup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
