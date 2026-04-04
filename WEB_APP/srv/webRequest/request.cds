
using WEB from '../../db/WEB';

@protocol: 'odata'
service requestDummy 
{
    
    @readonly entity DsupN6LoEUPzCGAE as select from WEB.T.DUMMYVIEW;    
}