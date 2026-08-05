from src.fetcher.datazone_fetcher import DataZoneFetcher
from src.mapper.metadata_mapper import MetadataMapper
from src.writer.denodo_writer import DenodoWriter
from src.config.settings import DENODO_DATABASE

def run_sync():
    print("Starting metadata sync...")
    print("-" * 60)

    fetcher = DataZoneFetcher()
    mapper = MetadataMapper()
    writer = DenodoWriter()

    writer.connect()
    print(f"Connected to Denodo VDP (database: {DENODO_DATABASE})")

    existing_views = writer.list_views(DENODO_DATABASE)
    assets = fetcher.list_assets()
    print(f"Found {len(existing_views)} views in Denodo, {len(assets)} assets in DataZone project")
    print("-" * 60)

    synced_count = 0
    skipped_count = 0

    for asset in assets:
        item = asset['assetItem']
        asset_name = item['name']
        print()

        if asset_name not in existing_views:
            print(f"Skipping asset: {asset_name} — no matching view in Denodo")
            skipped_count += 1
            continue

        full_asset = fetcher.get_asset(item['identifier'])
        metadata = fetcher.extract_metadata(full_asset)
        mapped = mapper.map_metadata(metadata)

        print(f"Syncing asset: {asset_name}")

        desc_updated = writer.update_view_description(asset_name, mapped['description'], DENODO_DATABASE)
        print("  Description updated" if desc_updated else "  No description found")

        col_count = writer.update_column_descriptions(asset_name, mapped['column_descriptions'], DENODO_DATABASE)
        print(f"  {col_count} columns updated" if col_count else "  No columns found")

        view_tag_count = writer.update_view_tags(asset_name, mapped['tags'], DENODO_DATABASE)
        print(f"  {view_tag_count} view tags updated" if view_tag_count else "  No view tags found")

        col_tag_count = writer.update_column_tags(asset_name, mapped['column_descriptions'], DENODO_DATABASE)
        print(f"  {col_tag_count} column tags updated" if col_tag_count else "  No column tags found")

        synced_count += 1

    print()
    writer.disconnect()
    print("Disconnected from Denodo VDP")
    print()
    print("-" * 60)
    print(f"Sync complete! Synced: {synced_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    run_sync()