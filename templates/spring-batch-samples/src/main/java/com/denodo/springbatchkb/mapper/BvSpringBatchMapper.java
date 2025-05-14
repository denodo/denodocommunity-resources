package com.denodo.springbatchkb.mapper;

import com.denodo.springbatchkb.entity.MyReadEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyReadEntityPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityAnalyticalPOJO;
import com.denodo.springbatchkb.entity.MyWriteEntityPOJO;
import org.apache.ibatis.annotations.Mapper;
import org.springframework.context.annotation.Primary;

import java.security.Timestamp;
import java.util.List;

@Mapper // MyBatis annotation
@Primary
public interface BvSpringBatchMapper {

    List<MyReadEntityPOJO> selectAllFromRead();

    List<MyReadEntityPOJO> selectWithFilter(Timestamp timestampColumn);

    List<MyReadEntityAnalyticalPOJO> selectAnalytical();

    void insertIntoWrite(MyWriteEntityPOJO writeItem);

    void insertIntoWriteAnalytical(MyWriteEntityAnalyticalPOJO writeItem);
}
