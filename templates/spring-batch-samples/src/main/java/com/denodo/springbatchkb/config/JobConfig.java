package com.denodo.springbatchkb.config;

import com.denodo.springbatchkb.component.MySteplet;
import com.denodo.springbatchkb.component.SimpleProcessorAnalytical;
import com.denodo.springbatchkb.component.SumProcessor;
import com.denodo.springbatchkb.entity.MyReadEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyReadEntityPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityPOJO;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemStreamReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class JobConfig {

    @Autowired
    @Qualifier("itemStreamReader")
    ItemStreamReader<MyReadEntityPOJO> itemStreamReader;
    @Autowired
    @Qualifier("filteredItemStreamReader")
    ItemStreamReader<MyReadEntityPOJO> filteredItemStreamReader;
    @Autowired
    @Qualifier("analyticalStreamReader")
    ItemStreamReader<MyReadEntityAnalyticalPOJO> analyticalStreamReader;
    @Autowired
    @Qualifier("itemWriter")
    ItemWriter<MyWriteEntityPOJO> itemWriter;
    @Autowired
    @Qualifier("analyticalItemWriter")
    ItemWriter<MyWriteEntityAnalyticalPOJO> analyticalItemWriter;
    @Autowired
    SumProcessor sumProcessor;
    @Autowired
    SimpleProcessorAnalytical simpleProcessorAnalytical;





    @Bean
    public Job myJob(JobRepository jobRepository, @Qualifier("stepAnalytical") Step myStep) {
        return new org.springframework.batch.core.job.builder.JobBuilder("myStep", jobRepository)
                .start(myStep)
                .build();
    }

    /* Query with analytical function */
    @Bean
    @Qualifier("stepAnalytical")
    public Step myAnalyticalStep(JobRepository jobRepository, PlatformTransactionManager transactionManager) {
        System.out.println("myStep@JobConfig");
        return new StepBuilder("myStep", jobRepository)
                .<MyReadEntityAnalyticalPOJO, MyWriteEntityAnalyticalPOJO>chunk(10)
                .reader(analyticalStreamReader)
                .writer(analyticalItemWriter)
                .processor(simpleProcessorAnalytical)
                .transactionManager(transactionManager)
                .allowStartIfComplete(true)
                .build();
    }

    /* Select * query */
    @Bean
    @Qualifier("stepSimpleRead")
    public Step myStepSimpleRead(JobRepository jobRepository, PlatformTransactionManager transactionManager) {
        System.out.println("myStepAnalytical@JobConfig");
        return new StepBuilder("myStep", jobRepository)
                .<MyReadEntityPOJO, MyWriteEntityPOJO>chunk(10)
                .reader(itemStreamReader)
                .writer(itemWriter)
                .processor(sumProcessor)
                .transactionManager(transactionManager)
                .allowStartIfComplete(true)
                .build();
    }

    /* Select * with filter query */
    @Bean
    @Qualifier("stepFilter")
    public Step myStepFilter(JobRepository jobRepository, PlatformTransactionManager transactionManager) {
        System.out.println("myStepAnalytical@JobConfig");
        return new StepBuilder("myStep", jobRepository)
                .<MyReadEntityPOJO, MyWriteEntityPOJO>chunk(10)
                .reader(filteredItemStreamReader)
                .processor(sumProcessor)
                .writer(itemWriter)
                .transactionManager(transactionManager)
                .allowStartIfComplete(true)
                .build();
    }




}