class MetadataMapper:
    def map_metadata(self, asset_metadata):
        """Pass through the extracted AWS metadata in the shape the writer expects"""
        return {
            'description': asset_metadata.get('description', ''),
            'column_descriptions': asset_metadata.get('column_descriptions', []),
            'tags': asset_metadata.get('tags', [])
        }
    


# from src.config.settings import ASSET_VIEW_MAPPING

# class MetadataMapper:
#     def __init__(self):
#         self.mapping = ASSET_VIEW_MAPPING

#     def get_mapping(self, asset_name):
#         """Find the matching Denodo view and database for a given AWS asset name"""
#         return self.mapping.get(asset_name)

#     def map_metadata(self, asset_metadata):
#         """Map AWS asset metadata to Denodo view metadata"""
#         asset_name = asset_metadata.get('name')
#         mapping = self.get_mapping(asset_name)

#         if not mapping:
#             print(f"No matching Denodo view found for asset: {asset_name}")
#             return None

#         return {
#             'view_name': mapping['view_name'],
#             'database': mapping['database'],
#             'description': asset_metadata.get('description', ''),
#             'column_descriptions': asset_metadata.get('column_descriptions', []),
#             'tags': asset_metadata.get('tags', []),
#             'asset_name': asset_name
#         }