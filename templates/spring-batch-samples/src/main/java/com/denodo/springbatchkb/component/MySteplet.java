package com.denodo.springbatchkb.component;

import com.denodo.springbatchkb.entity.MyReadEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyReadEntityPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityPOJO;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemStreamReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

import javax.annotation.processing.Processor;

/***
 * Contains a catalog of every component (reader, writer, processor) that can be used to build Job.
 * By autowiring this class you get access to all the components.
 */
//@Component
public class MySteplet {
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
/*
    public ItemStreamReader<MyReadEntityAnalyticalPOJO> reader(String queryId) {
        switch(queryId) {
            case "selectAllFromRead": return itemStreamReader;
            case "selectWithFilter": return filteredItemStreamReader;
            case "selectAnalytical": return analyticalStreamReader;
            default: throw new IllegalArgumentException("Query ID not valid: " + queryId);
        }
    }

    public ItemWriter<MyWriteEntityAnalyticalPOJO> writer(String queryId) {
        switch(queryId) {
            case "insertIntoWrite": return itemWriter;
            case "insertIntoWriteAnalytical": return analyticalItemWriter;
            default: throw new IllegalArgumentException("Query ID not valid: " + queryId);
        }
    }

    public ItemProcessor<MyReadEntityAnalyticalPOJO, MyWriteEntityAnalyticalPOJO> processor(String processorId) {
        switch(processorId) {
            case "sumProcessor": return simpleProcessorAnalytical;
            case "simpleProcessorAnalytical": return simpleProcessorAnalytical;
            default: throw new IllegalArgumentException("Processor ID not valid: " + processorId);
        }
    }
    */
}
