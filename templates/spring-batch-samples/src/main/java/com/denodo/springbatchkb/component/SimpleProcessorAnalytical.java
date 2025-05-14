package com.denodo.springbatchkb.component;


import com.denodo.springbatchkb.entity.MyReadEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyReadEntityPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityPOJO;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.annotation.AfterStep;
import org.springframework.batch.core.annotation.BeforeStep;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/***
 * simple implementation of a processor that copy all the values and sum two columns
 */
@Component
public class SimpleProcessorAnalytical implements ItemProcessor<MyReadEntityAnalyticalPOJO, MyWriteEntityAnalyticalPOJO> {
    @BeforeStep
    public void beforeStep(StepExecution stepExecution) {
        System.out.println("beforeStep@SimpleProcessorAnalytical");
    }

    /**
     *
     * @param item the entity that has been ridden
     * @return A new instance of the write entity class, based on the input (read) entity.
     * @throws Exception
     */
    @Override
    public MyWriteEntityAnalyticalPOJO process(MyReadEntityAnalyticalPOJO item) throws Exception {
        System.out.println("process@SimpleProcessorAnalytical");

        MyWriteEntityAnalyticalPOJO out = new MyWriteEntityAnalyticalPOJO(item);
        return out;
    }

    @AfterStep
    public void afterStep(StepExecution stepExecution) {
        System.out.println("afterStep@MyProcessor");
    }

}
