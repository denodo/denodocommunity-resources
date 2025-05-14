package com.denodo.springbatchkb.component;


import com.denodo.springbatchkb.entity.MyReadEntityPOJO;
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
public class SumProcessor implements ItemProcessor<MyReadEntityPOJO, MyWriteEntityPOJO> {
    @BeforeStep
    public void beforeStep(StepExecution stepExecution) {
        System.out.println("beforeStep@MyProcessor");
    }

    /**
     *
     * @param item the entity that has been ridden
     * @return A new instance of the write entity class, based on the input (read) entity.
     * @throws Exception
     */
    @Override
    public MyWriteEntityPOJO process(MyReadEntityPOJO item) throws Exception {
        System.out.println("process@SumProcessor");
        // sample transformation
        BigDecimal sum = BigDecimal.valueOf(-1);
        if(item.getNumeric_col_1() != null && item.getNumeric_col_2() != null)
            sum = item.getNumeric_col_1().add(item.getNumeric_col_2());
        MyWriteEntityPOJO out = new MyWriteEntityPOJO(item, sum);
        return out;
    }

    @AfterStep
    public void afterStep(StepExecution stepExecution) {
        System.out.println("afterStep@MyProcessor");
    }

}
