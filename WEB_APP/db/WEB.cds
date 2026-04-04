namespace WEB;

context T {
    @cds.persistence.exists 
    @cds.persistence.calcview 
    entity DUMMYVIEW {
    key     DUMID: Integer  @title: 'DUMID: Dummy id' ; 
            DUMMY: String(50)  @title: 'DUMMY: Dummy Data' ; 
            FYNAM: String(50)  @title: 'FYNAM: Dummy First name' ; 
            LSNAM: String(50)  @title: 'LSNAM: Dummy Last name' ; 
    }
    @cds.persistence.exists 
    @cds.persistence.calcview 
    entity COUNTLOG {
    key     WEBID: Integer  @title: 'WEBID: WEBID' ; 
            WENCT: String(50)  @title: 'WENCT: WENCT' ; 
            CHNBY: String(100)  @title: 'CHNBY: CHNBY' ; 
            CHNDT: Date  @title: 'CHNDT: CHNDT' ; 
            IPADD: String(45)  @title: 'IPADD: IPADD' ; 
            REQCT: Integer  @title: 'REQCT: REQCT' ; 
            REQDT: Date  @title: 'REQDT: REQDT' ; 
    }
}