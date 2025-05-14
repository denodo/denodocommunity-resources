package com.denodo.springbatchkb.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Configuration
public class AnnotateDataSources {

    /**
     * Metadata DataSource annotation
     * @return the annotated batch (metadata) datasource
     */
    @Bean(name = "batchDataSource")
    @Primary
    @ConfigurationProperties(prefix = "spring.batch.datasource")
    public DataSource batchDataSource() {
        return DataSourceBuilder.create().build();
    }

    /**
     * Data DataSource annotation
     * @return the annotated datasource (data)
     */
    @Bean(name = "dataSource")
    @ConfigurationProperties(prefix = "spring.datasource")
    public DataSource dataSource() {
        return DataSourceBuilder.create().build();
    }
}
