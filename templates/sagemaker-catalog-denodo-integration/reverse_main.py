from src.reader.denodo_reader import DenodoReader
from src.fetcher.datazone_fetcher import DataZoneFetcher
from src.writer.datazone_writer import DataZoneWriter
from src.config.settings import DENODO_DATABASE

def run_reverse_sync():
    print("Starting REVERSE sync (Denodo -> DataZone)...")
    print("-" * 60)

    reader = DenodoReader()
    fetcher = DataZoneFetcher()
    dz_writer = DataZoneWriter()

    reader.connect()
    print("Connected to Denodo VDP (reader)")

    view_descriptions = reader.read_view_descriptions()

    asset_ids = {}
    for a in fetcher.list_assets():
        item = a['assetItem']
        asset_ids[item['name']] = item['identifier']

    print(f"Found {len(view_descriptions)} views in Denodo, {len(asset_ids)} assets in DataZone project")
    print("-" * 60)

    synced_count = 0
    skipped_count = 0

    for view_name, description in view_descriptions.items():
        print()
        asset_id = asset_ids.get(view_name)

        if not asset_id:
            print(f"Skipping view: {view_name} — no matching asset in DataZone")
            skipped_count += 1
            continue

        col_desc_rows = reader.read_column_descriptions(view_name, DENODO_DATABASE)
        view_tag_data = reader.read_view_tags(DENODO_DATABASE).get(view_name, {'tags': [], 'columns': {}})
        view_tags = view_tag_data.get('tags', [])
        col_tags = view_tag_data.get('columns', {})

        print(f"Syncing view: {view_name}")

        result = dz_writer.update_asset_metadata(
            asset_id=asset_id,
            asset_name=view_name,
            description=description,
            column_descriptions=col_desc_rows,
            tags=view_tags,
            column_tags=col_tags
        )

        print("  Description updated" if result['description_updated'] else "  No description found")
        print(f"  {result['columns_updated']} columns updated" if result['columns_updated'] else "  No columns found")
        print(f"  {result['view_tags_updated']} view tags updated" if result['view_tags_updated'] else "  No view tags found")
        print(f"  {result['column_tags_updated']} column tags updated" if result['column_tags_updated'] else "  No column tags found")

        synced_count += 1

    print()
    reader.disconnect()
    print("Disconnected from Denodo VDP (reader)")
    print()
    print("-" * 60)
    print(f"Reverse sync complete! Synced: {synced_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    run_reverse_sync()