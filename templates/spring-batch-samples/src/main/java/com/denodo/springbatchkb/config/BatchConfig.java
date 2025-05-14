package com.denodo.springbatchkb.config;


import com.denodo.springbatchkb.entity.MyReadEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyReadEntityPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityPOJO;
import com.denodo.springbatchkb.component.DenodoMyBatisCursorItemReader;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.batch.builder.MyBatisBatchItemWriterBuilder;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.repository.support.JobRepositoryFactoryBean;
import org.springframework.batch.item.ItemStreamReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.Map;

/***
 * BatchConfig is necessary as Denodo is not recognized as a standard database that he can use to define the Job repository.
 * It must be configured manually.
 */
@Configuration
@EnableBatchProcessing
//@MapperScan("com.denodo.springbatchkb.mapper") // mybatis mappers: package path where the @Mapper class is located
@ComponentScan("com.denodo.springbatchkb.component") // spring batch components
public class BatchConfig {



    @Autowired @Qualifier("readerSqlSessionFactory")
    SqlSessionFactory readSqlSessionFactory;

    @Autowired @Qualifier("writerSqlSessionFactory")
    SqlSessionFactory writeSqlSessionFactory;


    /***
     * @return the ItemStreamReader required inside the MySteplet (AutoWired)
     */
    @Bean
    @StepScope
    @Qualifier("itemStreamReader")
    public ItemStreamReader<MyReadEntityPOJO> itemStreamReader() {
            DenodoMyBatisCursorItemReader<MyReadEntityPOJO> reader = new DenodoMyBatisCursorItemReader();
            reader.setSqlSessionFactory(this.readSqlSessionFactory);
            reader.setName("DenodoStreamReader");
            reader.setQueryId("selectAllFromRead");
            //reader.open(new ExecutionContext());
            return reader;
    }

    /***
     * @return the ItemStreamReader required inside the MySteplet (AutoWired)
     */
    @Bean
    @StepScope
    @Qualifier("filteredItemStreamReader")
    public ItemStreamReader<MyReadEntityPOJO> filteredItemStreamReader() {
        Map<String, Object> queryParams = new HashMap<>();
        queryParams.put("timestampColumn", Timestamp.valueOf("2025-03-24 00:00:00"));
        DenodoMyBatisCursorItemReader<MyReadEntityPOJO> reader = new DenodoMyBatisCursorItemReader();
        reader.setSqlSessionFactory(this.readSqlSessionFactory);
        reader.setParameterValues(queryParams);
        reader.setName("DenodoFilteredStreamReader");
        reader.setQueryId("selectWithFilter");
        return reader;
    }

    /***
     * @return the ItemStreamReader required inside the MySteplet (AutoWired)
     */
    @Bean
    @StepScope
    @Qualifier("analyticalStreamReader")
    public ItemStreamReader<MyReadEntityAnalyticalPOJO> analyticalStreamReader() {
        DenodoMyBatisCursorItemReader<MyReadEntityAnalyticalPOJO> reader = new DenodoMyBatisCursorItemReader();
        reader.setSqlSessionFactory(this.readSqlSessionFactory);
        reader.setName("DenodoStreamReader");
        reader.setQueryId("selectAnalytical");
        return reader;
    }

    /***
     * @return the ItemWriter required inside the MySteplet (AutoWired)
     */
    @Bean
    @StepScope
    @Qualifier("itemWriter")
    public ItemWriter<MyWriteEntityPOJO> itemWriter() {
        MyBatisBatchItemWriterBuilder<MyWriteEntityPOJO> writer = new MyBatisBatchItemWriterBuilder();
        writer.sqlSessionFactory(this.writeSqlSessionFactory);
        writer.assertUpdates(false);
        writer.statementId("insertIntoWrite");
        return writer.build();
    }

    /***
     * @return the ItemWriter required inside the MySteplet (AutoWired)
     */
    @Bean
    @StepScope
    @Qualifier("analyticalItemWriter")
    public ItemWriter<MyWriteEntityAnalyticalPOJO> analyticalItemWriter() {
        MyBatisBatchItemWriterBuilder<MyWriteEntityAnalyticalPOJO> writer = new MyBatisBatchItemWriterBuilder();
        writer.sqlSessionFactory(this.writeSqlSessionFactory);
        writer.assertUpdates(false);
        writer.statementId("insertIntoWriteAnalytical");
        return writer.build();
    }

    /***
     * Initialize the Batch JobRepository which set the target for persistent batch metadata to a specific DataSource.
     * The DataSource is annotated in a specific class.
     * @param batchDataSource The AutoWired DataSource to write/read persistent metadata
     * @return the customized JobRepository
     * @throws Exception
     */
    @Bean
    public JobRepository jobRepository(@Qualifier("batchDataSource") DataSource batchDataSource) throws Exception {
        JobRepositoryFactoryBean factory = new JobRepositoryFactoryBean();
        factory.setDataSource(batchDataSource);
        factory.setTransactionManager(new DataSourceTransactionManager(batchDataSource));
        factory.setDatabaseType("MYSQL");
        factory.afterPropertiesSet();
        return factory.getObject();
    }
}
