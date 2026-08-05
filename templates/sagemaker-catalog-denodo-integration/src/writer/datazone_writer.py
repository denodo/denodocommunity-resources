import json
import boto3
from src.config.settings import AWS_REGION, DATAZONE_DOMAIN_ID

class DataZoneWriter:
    def __init__(self):
        self.client = boto3.client('datazone', region_name=AWS_REGION)
        self.domain_id = DATAZONE_DOMAIN_ID

    def get_glossary_term_id(self, term_name):
        """Look up a glossary term ID by name"""
        response = self.client.search(
            domainIdentifier=self.domain_id,
            searchScope='GLOSSARY_TERM',
            searchText=term_name,
            searchIn=[{'attribute': 'name'}]
        )
        for item in response.get('items', []):
            term = item.get('glossaryTermItem', {})
            if term.get('name', '').lower() == term_name.lower():
                return term.get('id')
        return None

    def resolve_tag_names_to_ids(self, tag_names):
        """Convert a list of tag names to glossary term IDs"""
        ids = []
        for name in tag_names:
            term_id = self.get_glossary_term_id(name)
            if term_id:
                ids.append(term_id)
        return ids

    def update_asset_metadata(self, asset_id, asset_name, description, column_descriptions, tags, column_tags=None):
        """Create a new asset revision updating descriptions, column descriptions and glossary terms.
        Returns a dict of counts: description_updated, columns_updated, view_tags_updated, column_tags_updated
        """
        column_tags = column_tags or {}

        current = self.client.get_asset(
            domainIdentifier=self.domain_id,
            identifier=asset_id
        )

        glossary_term_ids = self.resolve_tag_names_to_ids(tags)

        columns_updated = 0
        column_tags_updated = 0

        forms_input = []
        for form in current.get('formsOutput', []):
            content = form['content']

            if form['formName'] == 'GlueTableForm':
                content_dict = json.loads(content)
                content_dict['tableDescription'] = description
                content = json.dumps(content_dict)

            elif form['formName'] == 'ColumnBusinessMetadataForm':
                content_dict = json.loads(content)
                for col in content_dict.get('columnsBusinessMetadata', []):
                    col_name = col.get('name')

                    if col_name in column_descriptions and column_descriptions[col_name]:
                        col['description'] = column_descriptions[col_name]
                        columns_updated += 1

                    if col_name in column_tags and column_tags[col_name]:
                        col_term_ids = self.resolve_tag_names_to_ids(column_tags[col_name])
                        if col_term_ids:
                            col['glossaryTerms'] = col_term_ids
                            column_tags_updated += len(col_term_ids)

                content = json.dumps(content_dict)

            forms_input.append({
                'formName': form['formName'],
                'typeIdentifier': form['typeName'],
                'typeRevision': form['typeRevision'],
                'content': content
            })

        revision_args = {
            'domainIdentifier': self.domain_id,
            'identifier': asset_id,
            'name': asset_name,
            'description': description,
            'formsInput': forms_input
        }
        if glossary_term_ids:
            revision_args['glossaryTerms'] = glossary_term_ids

        resp = self.client.create_asset_revision(**revision_args)
        revision = resp.get('revision')

        self.publish_asset(asset_id, revision)

        return {
            'description_updated': bool(description),
            'columns_updated': columns_updated,
            'view_tags_updated': len(glossary_term_ids),
            'column_tags_updated': column_tags_updated
        }

    def publish_asset(self, asset_id, revision):
        """Publish the latest asset revision to the catalog"""
        return self.client.create_listing_change_set(
            domainIdentifier=self.domain_id,
            entityIdentifier=asset_id,
            entityRevision=str(revision),
            entityType='ASSET',
            action='PUBLISH'
        )