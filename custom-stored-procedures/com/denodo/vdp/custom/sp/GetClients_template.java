package com.denodo.vdp.custom.sp;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;

import com.denodo.vdb.engine.storedprocedure.AbstractStoredProcedure;
import com.denodo.vdb.engine.storedprocedure.DatabaseEnvironment;
import com.denodo.vdb.engine.storedprocedure.StoredProcedureException;
import com.denodo.vdb.engine.storedprocedure.StoredProcedureParameter;

public class GetClients extends AbstractStoredProcedure {

	private DatabaseEnvironment environment;

    public GetClients() { }

    /**
     * This method is invoked when stored procedure is initialized
     *
     * @param environment object that allows communicate with VDP server
     */
    public void initialize(DatabaseEnvironment theEnvironment) {
        super.initialize(theEnvironment);
        this.environment = theEnvironment;
        // TODO Complete with your own code
    }

    /**
     * Gets store procedure description
     *
     * @return String
     */
    public String getDescription() {
        // TODO Replace with your description
        return "Stored Procedure";
    }

    /**
     * Gets store procedure name
     *
     * @return String
     */
    public String getName() {
        return GetClients.class.getName();
    }

    /**
     * Method where input and output parameters of the stored procedure are configured
     *
     * @return StoredProcedureParameter array with info about stored procedure parameters
     */
    public StoredProcedureParameter[] getParameters() {
        return new StoredProcedureParameter[] {
                new StoredProcedureParameter("number", Types.INTEGER, StoredProcedureParameter.DIRECTION_IN), // input parameter
                new StoredProcedureParameter("sum", Types.BIGINT, StoredProcedureParameter.DIRECTION_OUT)};
    }

    /**
     * This method is invoked when the stored procedure is executed
     *
     * @param object array with input parameters
     */
    public void doCall(Object[] inputValues) throws StoredProcedureException {
        ResultSet rs = null;
        try {
            // TODO replace with your own code related to the views available in the database
            Integer number = (Integer) inputValues[0];
			long sum = 0;
			
			String query = "SELECT " + number + "+" + number + " FROM DUAL()";
			rs = this.environment.executeQuery(query);
            while(rs.next()) {
                // TODO get the output of the query
                
                // Output rows 
                getProcedureResultSet().addRow(new Object[] { /* TODO Add your ouput fields here */ });
            }
 
        } catch (StoredProcedureException e) {
            this.environment.log(LOG_ERROR, e.getMessage());
            throw e;
        } catch (SQLException e) {
            this.environment.log(LOG_ERROR, e.getMessage());
            throw new StoredProcedureException(e);
        } finally {
            // Close resources
            if (rs!=null) {
                try {
                    rs.close();
                } catch (SQLException e) {
                     
                }                
            }
        }
    }

}
