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
                new StoredProcedureParameter("client_id", Types.VARCHAR, StoredProcedureParameter.DIRECTION_OUT),
                new StoredProcedureParameter("name",      Types.VARCHAR, StoredProcedureParameter.DIRECTION_OUT),
                new StoredProcedureParameter("surname",   Types.VARCHAR, StoredProcedureParameter.DIRECTION_OUT)};
    }

    /**
     * This method is invoked when the stored procedure is executed
     *
     * @param object array with input parameters
     */
    public void doCall(Object[] inputValues) throws StoredProcedureException {
        ResultSet rs = null;
        try {
            String query = "SELECT client_id, name, surname FROM tutorial.bv_crm_client WHERE client_type = '01'";
            rs = this.environment.executeQuery(query);
            while(rs.next()) {
                String client_id = rs.getString(1);
                String name      = rs.getString(2);
                String surname   = rs.getString(3);
                
                // Output rows 
                getProcedureResultSet().addRow(new Object[] { client_id, name, surname });
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
