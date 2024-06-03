package com.denodo.vdp.custom.functions;

import com.denodo.common.custom.annotations.CustomElement;
import com.denodo.common.custom.annotations.CustomElementType;
import com.denodo.common.custom.annotations.CustomExecutor;
import com.denodo.common.custom.annotations.CustomExecutorReturnType;
import com.denodo.common.custom.annotations.CustomParam;

@CustomElement(type=CustomElementType.VDPFUNCTION, name="STRINGCONCATENATE")
public class StringConcatenate {

    /**
     * This method is invoked when the custom function is executed
     * 
     * @param s input parameters
     * @return custom value
     */
    @CustomExecutor
    public Integer execute(@CustomParam(name = "s") String s) {

        // TODO: Replace with your own code
        return Integer.valueOf(s.length());
    }

    /**
     * This method is invoked to compute the return type before executing the function.
     * If the execute method returns a simple Java type, this method is not needed.
     * 
     * @param s type for execute the method input parameters
     * @return custom type that execute method will return
     */
    @CustomExecutorReturnType
    public Class<Integer> executeReturnType(String s) {
        // TODO: Replace with your own code
        return Integer.class;
    }
}
