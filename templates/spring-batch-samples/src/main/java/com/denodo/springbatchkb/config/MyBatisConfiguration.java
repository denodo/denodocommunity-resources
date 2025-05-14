package com.denodo.springbatchkb.config;

import org.apache.ibatis.mapping.DatabaseIdProvider;
import org.apache.ibatis.session.ExecutorType;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import javax.sql.DataSource;
import java.io.IOException;

/***
 * Configure MyBatis and creates two SQLSessions
 */
@Configuration(proxyBeanMethods = false)
public class MyBatisConfiguration {

    @Autowired
    @Qualifier("dataSource")
    DataSource dataSource;

    @Autowired
    DatabaseIdProvider denodoDatabaseIdProvider;

    @Bean
    @Primary
    public SqlSession persistenceSqlSession(SqlSessionFactory sqlSessionFactory) throws Exception {
        return new SqlSessionTemplate(sqlSessionFactory, ExecutorType.BATCH);
    }

    /***
     * Build the session factory used to write. Even if it is declared primary the reader bean can be used by using the
     * qualifier readerSqlSessionFactory.
     * @return a new SessionFactory, configured with executor type REUSE
     * @throws Exception if something goes wrong
     */
    @Bean
    @Primary
    public SqlSessionFactory writerSqlSessionFactory() throws Exception {
        SqlSessionFactoryBean sqlSessionFactory = new SqlSessionFactoryBean();
        sqlSessionFactory.setDataSource(this.dataSource);
        this.setMyBatisWriterConfigLocation(sqlSessionFactory);
        this.setMyBatisMapperLocation(sqlSessionFactory);
        sqlSessionFactory.setDatabaseIdProvider(denodoDatabaseIdProvider);
        sqlSessionFactory.afterPropertiesSet();
        return sqlSessionFactory.getObject();
    }

    /***
     * Build the session factory used to write
     * @return a new SessionFactory, configured with executor type BATCH
     * @throws Exception if something goes wrong
     */
    @Bean
    public SqlSessionFactory readerSqlSessionFactory() throws Exception {
        SqlSessionFactoryBean sqlSessionFactory = new SqlSessionFactoryBean();
        sqlSessionFactory.setDataSource(this.dataSource);
        this.setMyBatisReaderConfigLocation(sqlSessionFactory);
        this.setMyBatisMapperLocation(sqlSessionFactory);
        sqlSessionFactory.setDatabaseIdProvider(denodoDatabaseIdProvider);
        sqlSessionFactory.afterPropertiesSet();
        return sqlSessionFactory.getObject();
    }

    // Utils: Mybatis configuration loader
    protected void setMyBatisMapperLocation(SqlSessionFactoryBean sqlSessionFactory) throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Resource[] configLocation = resolver.getResources("classpath:mapper/*.xml");
        sqlSessionFactory.setMapperLocations(configLocation);
    }

    protected void setMyBatisWriterConfigLocation(SqlSessionFactoryBean sqlSessionFactory) throws Exception {
        System.out.println("MyBatis@BATCH");
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Resource configLocation = resolver
                .getResource("classpath:mybatis_config/mybatis-config-batch.xml");
        sqlSessionFactory.setConfigLocation(configLocation);

    }

    protected void setMyBatisReaderConfigLocation(SqlSessionFactoryBean sqlSessionFactory) throws Exception {
        System.out.println("MyBatis@REUSE");
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Resource configLocation = resolver
                .getResource("classpath:mybatis_config/mybatis-config-reuse.xml");
        sqlSessionFactory.setConfigLocation(configLocation);
    }
}
