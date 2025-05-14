package com.denodo.springbatchkb.config;

import org.apache.ibatis.mapping.DatabaseIdProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.Properties;

/***
 * Required by MyBatis!
 * Provide the DatabaseIdProvider. This identifies the database and the queries that can be associated with.
 * In the MyBatis mapper, the queries will specify the DatabaseIdProvider, MyBatis associate the DataSource with those queries.
 */
@Configuration
public class DenodoDatabaseIdProviderConfig {

    @Bean
    public DatabaseIdProvider databaseIdProvider(DataSource dataSource) {
        return new DenodoDatabaseIdProvider(dataSource);
    }

    static class DenodoDatabaseIdProvider implements DatabaseIdProvider {

        DataSource dataSource;
        public DenodoDatabaseIdProvider(DataSource dataSource) {
            this.dataSource = dataSource;
        }

        @Override
        public void setProperties(Properties p) {
            DatabaseIdProvider.super.setProperties(p);
        }

        @Override
        public String getDatabaseId(DataSource dataSource) {
            try {
                DatabaseMetaData metaData = dataSource.getConnection().getMetaData();
                String databaseProductName = metaData.getDatabaseProductName();
                if ("Virtual DataPort".equals(databaseProductName)) {
                    return "denodo";
                }
                return null;
            } catch (SQLException e) {
                return null;
            }
        }
    }
}
