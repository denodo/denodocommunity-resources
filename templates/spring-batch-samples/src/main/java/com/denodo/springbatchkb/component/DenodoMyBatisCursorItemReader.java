package com.denodo.springbatchkb.component;

import org.apache.ibatis.cursor.Cursor;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.springframework.batch.item.support.AbstractItemCountingItemStreamItemReader;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.util.Assert;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

public class DenodoMyBatisCursorItemReader<T> extends AbstractItemCountingItemStreamItemReader<T> implements InitializingBean {
    private SqlSessionFactory sqlSessionFactory;
    private SqlSession sqlSession;
    private Cursor<T> cursor;
    private String queryId;
    private Iterator<T> cursorIterator;
    private Map<String, Object> parameterValues;

    public void setSqlSessionFactory(SqlSessionFactory sqlSessionFactory) {
        this.sqlSessionFactory = sqlSessionFactory;
    }

    // methods of AbstractItemCountingItemStreamItemReader
    @Override
    protected T doRead() throws Exception {
        System.out.println("read@DenodoMyBatisCursorItemReader");
        T next = null;
        if (this.cursorIterator.hasNext()) {
            next = this.cursorIterator.next();
        }

        return next;
    }

    @Override
    protected void doOpen() throws Exception {
        System.out.println("open@DenodoMyBatisCursorItemReader");
        Map<String, Object> parameters = new HashMap();
        if (this.parameterValues != null) {
            parameters.putAll(this.parameterValues);
        }
        this.sqlSession = this.sqlSessionFactory.openSession();
        this.cursor = this.sqlSession.selectCursor(this.queryId, parameters);
        this.cursorIterator = this.cursor.iterator();
    }

    @Override
    protected void doClose() throws Exception {
        if (this.cursor != null) {
            this.cursor.close();
        }

        if (this.sqlSession != null) {
            this.sqlSession.close();
        }

        this.cursorIterator = null;
    }

    public void setQueryId(String queryId) {
        this.queryId = queryId;
    }

    public void setParameterValues(Map<String, Object> parameterValues) {
        this.parameterValues = parameterValues;
    }

    // check that all parameters have been set
    @Override
    public void afterPropertiesSet() throws Exception {
        Assert.notNull(this.sqlSessionFactory, "A SqlSessionFactory is required.");
        Assert.notNull(this.queryId, "A queryId is required.");
    }
}
