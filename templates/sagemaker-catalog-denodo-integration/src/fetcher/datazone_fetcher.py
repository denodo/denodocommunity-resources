import boto3
import json
from src.config.settings import AWS_REGION, DATAZONE_DOMAIN_ID, DATAZONE_PROJECT_ID

class DataZoneFetcher:
    def __init__(self):
        self.client = boto3.client('datazone', region_name=AWS_REGION)
        self.domain_id = DATAZONE_DOMAIN_ID
        self.project_id = DATAZONE_PROJECT_ID

    def list_assets(self):
        """List all assets in the domain"""
        response = self.client.search(
            domainIdentifier=self.domain_id,
            searchScope='ASSET',
            owningProjectIdentifier=self.project_id
        )
        return response.get('items', [])

    def get_asset(self, asset_id):
        response = self.client.get_asset(
            domainIdentifier=self.domain_id,
            identifier=asset_id
        )
        return response

        # # print glossary terms 
        # if response.get('name') == 'customers':
        #     for form in response.get('formsOutput', []):
        #         if form.get('formName') == 'ColumnBusinessMetadataForm':
        #             print(f"ColumnBusinessMetadataForm: {form['content']}")
        # return response
    
        # if response.get('name') == 'customers':
        #     print("=" * 60)
        #     for form in response.get('formsOutput', []):
        #         print(f"FORM NAME: {form.get('formName')}")
        #         print(f"CONTENT: {form.get('content')}")
        #         print("-" * 60)

        # return response


    def extract_metadata(self, asset):
        """Pull out table description, column descriptions and glossary terms"""
        description = ''
        column_descriptions = []
        table_glossary_terms = []

        # Resolve glossary term IDs to names
        def resolve_terms(term_ids):
            names = []
            for term_id in (term_ids or []):
                try:
                    term = self.client.get_glossary_term(
                        domainIdentifier=self.domain_id,
                        identifier=term_id
                    )
                    names.append(term.get('name'))
                except Exception:
                    pass
            return names

        # Resolve table-level glossary terms
        table_glossary_terms = resolve_terms(asset.get('glossaryTerms', []))

        for form in asset.get('formsOutput', []):
            form_name = form.get('formName')

            if form_name == 'GlueTableForm':
                content = json.loads(form.get('content', '{}'))
                description = content.get('tableDescription', '')

            elif form_name == 'ColumnBusinessMetadataForm':
                content = json.loads(form.get('content', '{}'))
                for col in content.get('columnsBusinessMetadata', []):
                    col_terms = resolve_terms(col.get('glossaryTerms', []))
                    col_desc = col.get('description', '')
                    if col_desc or col_terms:
                        column_descriptions.append({
                            'column': col.get('name'),
                            'description': col_desc,
                            'tags': col_terms
                        })

        return {
            'name': asset.get('name'),
            'description': description,
            'tags': table_glossary_terms,
            'column_descriptions': column_descriptions,
            'asset_id': asset.get('id')
        }