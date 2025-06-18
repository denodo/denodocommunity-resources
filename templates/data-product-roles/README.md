# Denodo Data Products Lifecycle Roles

The **Denodo Data Products Lifecycle Roles** project includes sample  creation scripts for the roles defined in the [Denodo Data Products Lifecycle Roles](https://community.denodo.com/kb/en/view/document/Denodo%20Data%20Products%20Lifecycle%20Roles) Knowledge Base article.

List of scripts: 
* [vdp-metadata-data-product-roles.vql](vdp-metadata-data-product-roles.vql): Import this VQL file into your **Virtual DataPort** server using `denodo` as the import password. It will create the following roles and tags:

    | Virtual DataPort Roles | 
    | ---- | 
    | business_user, data_consumer, data_governance_manager, data_product_developer, data_product_owner, platform_owner | 

    | Virtual DataPort Tags | 
    | ---- | 
    | confidential, customer_data, email_address, employee_data, external_sharing, finance_reporting, healthcare_dataset, hipaa_protected, marketing_analytics, mask_if_not_admin, pii, prod_env, salary, sensitive, ssn |

* [sm-metadata-data-product-roles.json](sm-metadata-data-product-roles.json): Import this file into your **Denodo Solution Manager**, it will create the following roles:

    | Solution Manager Roles | |
    | ---- | ---- |
    | **Roles** | **Sub-roles assigned** |
    | data_product_developer | monitor_admin, solution_manager_promotion, solution_manager_promotion_development, solution_manager_promotion_staging |
    | data_product_owner | monitor_admin, solution_manager_promotion, solution_manager_promotion_production, solution_manager_promotion_staging |
    | platform_owner | global_admin |

* [dc-metadata-data-product-roles.zip](dc-metadata-data-product-roles.zip): Import this file into the **Data Catalog** to create the following roles:

    | Data Catalog Roles | 
    | ---- | 
    | business_user, data_governance_manager, data_product_developer, data_product_owner |

* [denodo-scheduler-metadata-data-product-roles.zip](denodo-scheduler-metadata-data-product-roles.zip): Import this file into the **Denodo Scheduler** to configure the roles:

    | Scheduler Roles | 
    | ---- | 
    | data_product_developer, data_product_owner, platform_owner |
